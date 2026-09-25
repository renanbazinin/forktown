import type { TrackId } from './score';
import type { Mix } from './render';
import type { CinemaFilm } from '../lib/cinema';

export function renderTrack(track: TrackId): Promise<AudioBuffer> {
  return renderAudio(
    new Worker(new URL('./render-worker.ts', import.meta.url), { type: 'module' }),
    track,
  );
}

export function renderCinemaTrack(film: CinemaFilm): Promise<AudioBuffer> {
  return renderAudio(
    new Worker(new URL('./cinema-worker.ts', import.meta.url), { type: 'module' }),
    film,
  );
}

/** Every football effect take as mono samples, keyed `kind:take`. */
export function renderFootballTakes(sampleRate: number): Promise<Map<string, Float32Array>> {
  return new Promise((resolve, reject) => {
    // Constructed inside the promise, so a page without workers just falls back to on-demand takes.
    const worker = new Worker(new URL('./football-worker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Football sounds took too long to prepare.'));
    }, 30000);
    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('Could not prepare the football sounds.'));
    };
    worker.onmessage = (event: MessageEvent<[string, Float32Array][] | { error: string }>) => {
      cleanup();
      if ('error' in event.data) reject(new Error(event.data.error));
      else resolve(new Map(event.data));
    };
    worker.postMessage(sampleRate);
  });
}

function renderAudio(worker: Worker, input: TrackId | CinemaFilm): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Music took too long to prepare.'));
    }, 30000);
    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('Could not prepare the soundtrack.'));
    };
    worker.onmessage = (event: MessageEvent<Mix | { error: string }>) => {
      cleanup();
      if ('error' in event.data) {
        reject(new Error(event.data.error));
        return;
      }
      try {
        const mix = event.data;
        const buffer = new AudioBuffer({
          length: mix.left.length,
          numberOfChannels: 2,
          sampleRate: mix.sampleRate,
        });
        buffer.copyToChannel(mix.left as Float32Array<ArrayBuffer>, 0);
        buffer.copyToChannel(mix.right as Float32Array<ArrayBuffer>, 1);
        resolve(buffer);
      } catch (error) {
        reject(error);
      }
    };
    worker.postMessage(input);
  });
}
