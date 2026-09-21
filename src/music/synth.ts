import type { TrackId } from './score';
import type { Mix } from './render';

export function renderTrack(track: TrackId): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./render-worker.ts', import.meta.url), { type: 'module' });
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
    worker.postMessage(track);
  });
}
